routerAdd(
  'POST',
  '/backend/v1/inventory-counts/submit',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const counts = body.counts
    if (!Array.isArray(counts) || counts.length === 0) {
      return e.badRequestError('Lista de contagens é obrigatória')
    }

    for (let i = 0; i < counts.length; i++) {
      const c = counts[i]
      if (!c.product_id) {
        return e.badRequestError('product_id é obrigatório (item ' + (i + 1) + ')')
      }
      if (!c.subarea_id) {
        return e.badRequestError('subarea_id é obrigatório (item ' + (i + 1) + ')')
      }
      if (
        c.counted_quantity === null ||
        c.counted_quantity === undefined ||
        c.counted_quantity === ''
      ) {
        return e.badRequestError('counted_quantity é obrigatório (item ' + (i + 1) + ')')
      }
      const numQty = Number(c.counted_quantity)
      if (isNaN(numQty)) {
        return e.badRequestError(
          'counted_quantity deve ser um número válido (item ' + (i + 1) + ')',
        )
      }
    }

    try {
      $app.runInTransaction(function (txApp) {
        for (let i = 0; i < counts.length; i++) {
          const c = counts[i]
          const qty = Number(c.counted_quantity)

          var previousQty = 0
          var levelRecord = null
          try {
            levelRecord = txApp.findFirstRecordByFilter(
              'inventory_levels',
              "product_id = '" + c.product_id + "' && subarea_id = '" + c.subarea_id + "'",
            )
            previousQty = levelRecord.get('quantity') || 0
          } catch (_) {}

          var countsCol = txApp.findCollectionByNameOrId('inventory_counts')
          var countRecord = new Record(countsCol)
          countRecord.set('product_id', c.product_id)
          countRecord.set('user_id', userId)
          countRecord.set('previous_quantity', previousQty)
          countRecord.set('counted_quantity', qty)
          countRecord.set('subarea_id', c.subarea_id)
          txApp.save(countRecord)

          if (levelRecord) {
            levelRecord.set('quantity', qty)
            txApp.save(levelRecord)
          } else {
            var levelsCol = txApp.findCollectionByNameOrId('inventory_levels')
            var newLevel = new Record(levelsCol)
            newLevel.set('product_id', c.product_id)
            newLevel.set('subarea_id', c.subarea_id)
            newLevel.set('quantity', qty)
            txApp.save(newLevel)
          }
        }
      })

      return e.json(201, { success: true, count: counts.length })
    } catch (err) {
      return e.json(500, {
        message: 'Erro ao salvar contagens: ' + (err.message || 'erro desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)
