migrate(
  (app) => {
    // 1. Atualizar a definição do campo 'unit' na coleção 'products'
    const col = app.findCollectionByNameOrId('products')
    const unitField = col.fields.getByName('unit')
    if (unitField) {
      unitField.values = ['kg', 'litro', 'unidade', 'fração']
      app.save(col)
    }

    // 2. Atualizar registros existentes com unit = 'caixa' para 'fração'
    app.db().newQuery("UPDATE products SET unit = 'fração' WHERE unit = 'caixa'").execute()
  },
  (app) => {
    // Reverter registros e schema se necessário
    app.db().newQuery("UPDATE products SET unit = 'caixa' WHERE unit = 'fração'").execute()

    const col = app.findCollectionByNameOrId('products')
    const unitField = col.fields.getByName('unit')
    if (unitField) {
      unitField.values = ['kg', 'litro', 'unidade', 'caixa']
      app.save(col)
    }
  },
)
