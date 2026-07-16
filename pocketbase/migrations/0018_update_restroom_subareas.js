migrate(
  (app) => {
    const subareasCol = app.findCollectionByNameOrId('subareas')

    let banheirosAreaId = null

    try {
      const banheiros = app.findFirstRecordByData('subareas', 'name', 'BANHEIROS')
      banheirosAreaId = banheiros.get('area_id')
      banheiros.set('name', 'BANHEIRO MASCULINO')
      app.save(banheiros)
    } catch (_) {
      console.log('Subarea "BANHEIROS" not found — skipping rename.')
    }

    if (banheirosAreaId) {
      try {
        app.findFirstRecordByData('subareas', 'name', 'BANHEIRO FEMININO')
      } catch (_) {
        const r = new Record(subareasCol)
        r.set('name', 'BANHEIRO FEMININO')
        r.set('area_id', banheirosAreaId)
        app.save(r)
      }
    }

    try {
      const salao = app.findFirstRecordByData('areas', 'name', 'SALÃO')
      try {
        app.findFirstRecordByData('subareas', 'name', 'CORREDOR EXTERNO')
      } catch (_) {
        const r = new Record(subareasCol)
        r.set('name', 'CORREDOR EXTERNO')
        r.set('area_id', salao.id)
        app.save(r)
      }
    } catch (_) {
      console.log('Area "SALÃO" not found — skipping CORREDOR EXTERNO creation.')
    }
  },
  (app) => {
    const subareasCol = app.findCollectionByNameOrId('subareas')

    try {
      const masculino = app.findFirstRecordByData('subareas', 'name', 'BANHEIRO MASCULINO')
      masculino.set('name', 'BANHEIROS')
      app.save(masculino)
    } catch (_) {}

    try {
      const feminino = app.findFirstRecordByData('subareas', 'name', 'BANHEIRO FEMININO')
      app.delete(feminino)
    } catch (_) {}

    try {
      const corredor = app.findFirstRecordByData('subareas', 'name', 'CORREDOR EXTERNO')
      app.delete(corredor)
    } catch (_) {}
  },
)
