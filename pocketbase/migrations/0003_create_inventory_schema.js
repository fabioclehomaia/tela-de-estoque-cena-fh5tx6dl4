migrate(
  (app) => {
    const writeRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    const readRule = "@request.auth.id != ''"

    const areas = new Collection({
      name: 'areas',
      type: 'base',
      listRule: readRule,
      viewRule: readRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(areas)

    const subareas = new Collection({
      name: 'subareas',
      type: 'base',
      listRule: readRule,
      viewRule: readRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'area_id',
          type: 'relation',
          collectionId: areas.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(subareas)

    const categories = new Collection({
      name: 'categories',
      type: 'base',
      listRule: readRule,
      viewRule: readRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(categories)

    const products = new Collection({
      name: 'products',
      type: 'base',
      listRule: readRule,
      viewRule: readRule,
      createRule: writeRule,
      updateRule: writeRule,
      deleteRule: writeRule,
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'unit',
          type: 'select',
          required: true,
          values: ['kg', 'litro', 'unidade', 'caixa'],
          maxSelect: 1,
        },
        { name: 'validity_days', type: 'number' },
        { name: 'min_stock', type: 'number' },
        {
          name: 'category_id',
          type: 'relation',
          collectionId: categories.id,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'subarea_id',
          type: 'relation',
          collectionId: subareas.id,
          required: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(products)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('products'))
    app.delete(app.findCollectionByNameOrId('subareas'))
    app.delete(app.findCollectionByNameOrId('categories'))
    app.delete(app.findCollectionByNameOrId('areas'))
  },
)
