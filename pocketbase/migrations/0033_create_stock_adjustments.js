migrate(
  (app) => {
    const collection = new Collection({
      name: 'stock_adjustments',
      type: 'base',
      // Apenas admin/manager podem criar e ler ajustes de estoque.
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')",
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'product',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('products').id,
          maxSelect: 1,
        },
        {
          name: 'count',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('inventory_counts').id,
          maxSelect: 1,
        },
        // DATA DA CONTAGEM que se pretende ajustar (não a data de hoje).
        { name: 'adjustment_date', type: 'date', required: true },
        { name: 'original_quantity', type: 'number', required: true, onlyInt: false },
        { name: 'corrected_quantity', type: 'number', required: true, onlyInt: false },
        { name: 'reason', type: 'text', required: false, maxSize: 2000 },
        {
          name: 'adjusted_by',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE INDEX idx_stock_adjustments_product ON stock_adjustments (product)',
        'CREATE INDEX idx_stock_adjustments_count ON stock_adjustments (count)',
        'CREATE INDEX idx_stock_adjustments_date ON stock_adjustments (adjustment_date)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('stock_adjustments')
    app.delete(collection)
  },
)
