migrate(
  (app) => {
    const levels = app.findCollectionByNameOrId('inventory_levels')
    levels.updateRule = "@request.auth.id != ''"
    app.save(levels)

    const counts = app.findCollectionByNameOrId('inventory_counts')
    counts.listRule = "@request.auth.id != ''"
    counts.viewRule = "@request.auth.id != ''"
    app.save(counts)
  },
  (app) => {
    const levels = app.findCollectionByNameOrId('inventory_levels')
    levels.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    app.save(levels)

    const counts = app.findCollectionByNameOrId('inventory_counts')
    counts.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    counts.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.role = 'manager')"
    app.save(counts)
  },
)
