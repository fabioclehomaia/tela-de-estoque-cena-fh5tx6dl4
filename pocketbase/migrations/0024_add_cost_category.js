migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('products')
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
      app.save(col)
      app
        .db()
        .newQuery(
          "UPDATE products SET cost_category = 'CMV' WHERE cost_category IS NULL OR cost_category = ''",
        )
        .execute()
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('products')
    if (col.fields.getByName('cost_category')) {
      col.fields.removeByName('cost_category')
      app.save(col)
    }
  },
)
