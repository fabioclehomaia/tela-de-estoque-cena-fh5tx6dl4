migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('compras')

    // Modificar product_id e supplier_id para não serem obrigatórios (permitindo compras avulsas)
    const prodField = col.fields.getByName('product_id')
    if (prodField) {
      prodField.required = false
    }

    const supField = col.fields.getByName('supplier_id')
    if (supField) {
      supField.required = false
    }

    // Adicionar description (texto livre para compra avulsa)
    if (!col.fields.getByName('description')) {
      col.fields.add(
        new TextField({
          name: 'description',
          required: false,
        }),
      )
    }

    // Adicionar cost_category
    if (!col.fields.getByName('cost_category')) {
      col.fields.add(
        new SelectField({
          name: 'cost_category',
          required: false,
          values: [
            'CMV',
            'Manutenção predial',
            'Utensílios',
            'Alimentação de funcionários',
            'Limpeza',
            'Descartáveis',
            'Decoração',
            'Operacional',
          ],
          maxSelect: 1,
        }),
      )
    }

    // Adicionar is_avulsa (bool)
    if (!col.fields.getByName('is_avulsa')) {
      col.fields.add(
        new BoolField({
          name: 'is_avulsa',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('compras')
    if (col.fields.getByName('description')) {
      col.fields.removeByName('description')
    }
    if (col.fields.getByName('cost_category')) {
      col.fields.removeByName('cost_category')
    }
    if (col.fields.getByName('is_avulsa')) {
      col.fields.removeByName('is_avulsa')
    }
    app.save(col)
  },
)
