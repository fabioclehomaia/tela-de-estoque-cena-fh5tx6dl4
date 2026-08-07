migrate(
  (app) => {
    const collection = new Collection({
      name: 'compras',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      fields: [
        {
          name: 'product_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('products').id,
          maxSelect: 1,
        },
        {
          name: 'supplier_id',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('fornecedores').id,
          maxSelect: 1,
        },
        { name: 'quantity', type: 'number', required: true },
        { name: 'price', type: 'number', required: true },
        { name: 'nota_fiscal', type: 'text', required: false },
        { name: 'payment_term', type: 'text', required: false },
        { name: 'date', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_compras_product ON compras (product_id)',
        'CREATE INDEX idx_compras_supplier ON compras (supplier_id)',
        'CREATE INDEX idx_compras_date ON compras (date)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('compras')
    app.delete(collection)
  },
)
