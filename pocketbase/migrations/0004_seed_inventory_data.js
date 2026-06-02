migrate(
  (app) => {
    const areasCol = app.findCollectionByNameOrId('areas')
    const subareasCol = app.findCollectionByNameOrId('subareas')
    const categoriesCol = app.findCollectionByNameOrId('categories')

    const ensureArea = (name) => {
      try {
        return app.findFirstRecordByData('areas', 'name', name)
      } catch (_) {
        const r = new Record(areasCol)
        r.set('name', name)
        app.save(r)
        return r
      }
    }

    const areaCozinha = ensureArea('Cozinha')
    const areaBar = ensureArea('Bar')
    const areaSalao = ensureArea('Salão')

    const ensureSubarea = (name, areaId) => {
      try {
        return app.findFirstRecordByData('subareas', 'name', name)
      } catch (_) {
        const r = new Record(subareasCol)
        r.set('name', name)
        r.set('area_id', areaId)
        app.save(r)
        return r
      }
    }

    ensureSubarea('Geladeira', areaCozinha.id)
    ensureSubarea('Despensa', areaCozinha.id)
    ensureSubarea('Garrafeira', areaBar.id)
    ensureSubarea('Prateleira', areaSalao.id)

    const ensureCategory = (name) => {
      try {
        return app.findFirstRecordByData('categories', 'name', name)
      } catch (_) {
        const r = new Record(categoriesCol)
        r.set('name', name)
        app.save(r)
        return r
      }
    }

    ;['Proteína', 'Hortaliça', 'Bebida', 'Insumo', 'Grãos'].forEach(ensureCategory)
  },
  (app) => {
    // Irreversible or manual cleanup
  },
)
