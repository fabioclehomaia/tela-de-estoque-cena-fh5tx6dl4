routerAdd(
  'POST',
  '/backend/v1/compras/ler-nota',
  (e) => {
    const authUser = e.auth
    if (!authUser || !authUser.id) {
      return e.unauthorizedError('Autenticação necessária')
    }

    let files = []
    try {
      files = e.findUploadedFiles('arquivo')
    } catch (_) {}

    if (!files || files.length === 0) {
      try {
        files = e.findUploadedFiles('file')
      } catch (_) {}
    }

    const body = e.requestInfo().body || {}
    let textContent = ''
    let isImage = false
    let imageBase64 = ''
    let imageMime = ''

    if (files && files.length > 0) {
      const file = files[0]
      const originalName = (file.name || '').toLowerCase()

      // Caso 1: Documento (PDF, DOCX, XLSX, PPTX)
      if (
        originalName.endsWith('.pdf') ||
        originalName.endsWith('.xlsx') ||
        originalName.endsWith('.xls') ||
        originalName.endsWith('.docx')
      ) {
        try {
          const docRes = $documents.toMarkdown({ file: file })
          textContent = docRes.markdown || ''
        } catch (err) {
          // Se for PDF escaneado (sem camada de texto) ou erro de OCR
          if (err.status === 422 || (err.message && err.message.toLowerCase().includes('ocr'))) {
            return e.json(422, {
              error:
                'O arquivo PDF enviado não possui camada de texto selecionável (página escaneada). Por favor, tire uma foto nítida da nota ou envie um PDF com texto selecionável.',
            })
          }
          return e.json(400, {
            error: 'Não foi possível ler o documento: ' + (err.message || 'formato ilegível'),
          })
        }
      }
    }

    // Se o cliente já enviou imagem em base64 no body ou texto extraído (ex: XML ou texto direto)
    if (body.image_base64) {
      isImage = true
      imageBase64 = body.image_base64
      imageMime = body.image_mime || 'image/jpeg'
    }

    if (body.text_content && !textContent) {
      textContent = body.text_content
    }

    if (!textContent && !imageBase64 && !isImage) {
      return e.badRequestError('Nenhum arquivo ou texto válido enviado.')
    }

    // Montar prompt para IA
    const systemPrompt = `Você é um assistente especialista em ler e interpretar documentos fiscais e comerciais brasileiros (Notas Fiscais, Cupons Fiscais, NF-e, Danfe, recibos, pedidos de compra, faturas e planilhas de compras).
Sua tarefa é extrair os dados da compra e retornar EXCLUSIVAMENTE um objeto JSON válido (sem tags markdown, sem blocos de código \`\`\`, apenas o JSON bruto).

O formato de retorno DEVE ser exatamente:
{
  "fornecedor": "Nome da empresa/fornecedor ou vazio se não identificado",
  "data": "AAAA-MM-DD ou vazio se não identificada",
  "nota_fiscal": "Número da NF ou vazio",
  "valor_total": 0.00,
  "confianca_geral": "alta" | "media" | "baixa",
  "observacao": "Mensagem ou alerta caso haja dúvidas ou baixa nitidez",
  "itens": [
    {
      "descricao": "Nome do item ou produto",
      "quantidade": 1.0,
      "unidade": "kg" | "litro" | "unidade" | "fração",
      "preco_unitario": 0.00,
      "valor_total": 0.00,
      "confianca": "alta" | "media" | "baixa",
      "avulso": false
    }
  ]
}

Regras:
1. Mapeie a unidade dos itens para uma das opções aceitas no sistema: "kg", "litro", "unidade" ou "fração" (use "fração" para caixas, fardos, pacotes ou porções fracionadas; use "unidade" para un/pc/cx individual).
2. Se a quantidade ou preço unitário não estiver explícito mas houver valor total do item, infira quantidade = 1 e preco_unitario = valor_total.
3. Se algum item estiver borrado, ambíguo ou com valores incertos, marque "confianca": "baixa" ou "media".
4. Se o documento for completamente ilegível ou não parecer uma nota/compra, retorne "confianca_geral": "baixa", "itens": [] e explique em "observacao".
5. Retorne APENAS o JSON puro.`

    let messages = [{ role: 'system', content: systemPrompt }]

    if (isImage && imageBase64) {
      const dataUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : 'data:' + imageMime + ';base64,' + imageBase64

      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analise esta foto de nota fiscal / recibo e extraia os itens conforme solicitado.',
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      })
    } else {
      messages.push({
        role: 'user',
        content:
          'Aqui está o conteúdo do documento / planilha / nota fiscal extraído:\n\n' +
          (textContent || '').slice(0, 15000) +
          '\n\nExtraia todos os itens e informações da nota.',
      })
    }

    try {
      const reply = $ai.chat({
        model: 'fast',
        messages: messages,
      })

      const rawContent =
        reply &&
        reply.choices &&
        reply.choices[0] &&
        reply.choices[0].message &&
        reply.choices[0].message.content
          ? reply.choices[0].message.content.trim()
          : ''

      if (!rawContent) {
        return e.json(500, {
          error: 'A IA não retornou resposta. Tente novamente ou revise manualmente.',
        })
      }

      // Limpar possíveis crases de markdown
      let cleanJson = rawContent
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7)
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3)
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3)
      }
      cleanJson = cleanJson.trim()

      let parsed = null
      try {
        parsed = JSON.parse(cleanJson)
      } catch (jsonErr) {
        // Tentar extrair primeiro bloco {...}
        const start = cleanJson.indexOf('{')
        const end = cleanJson.lastIndexOf('}')
        if (start !== -1 && end !== -1 && end > start) {
          parsed = JSON.parse(cleanJson.slice(start, end + 1))
        } else {
          throw jsonErr
        }
      }

      return e.json(200, parsed)
    } catch (err) {
      console.log('Erro ao processar nota com IA:', err.message)
      return e.json(500, {
        error:
          'Não foi possível analisar o arquivo com IA: ' +
          (err.message ||
            'Falha de comunicação com o serviço de IA. Verifique sua conexão e tente novamente.'),
      })
    }
  },
  $apis.requireAuth(),
)
