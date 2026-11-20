/**
 * Correção do bug "original_quantity: Cannot be blank" ao gravar um ajuste de
 * estoque com estoque anterior 0: o PocketBase trata valor 0 em campo numérico
 * `required` como vazio e rejeita o POST com 400. Mesma correção já aplicada
 * às contagens (0021) e aos níveis de estoque (0030). Nenhuma regra de acesso
 * é alterada aqui — a createRule continua apenas "@request.auth.id != ''"
 * (migração 0035); NÃO reintroduzir comparações @request.body.* nela.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('stock_adjustments')

    const original = collection.fields.getByName('original_quantity')
    original.required = false

    const corrected = collection.fields.getByName('corrected_quantity')
    corrected.required = false

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('stock_adjustments')

    const original = collection.fields.getByName('original_quantity')
    original.required = true

    const corrected = collection.fields.getByName('corrected_quantity')
    corrected.required = true

    app.save(collection)
  },
)
