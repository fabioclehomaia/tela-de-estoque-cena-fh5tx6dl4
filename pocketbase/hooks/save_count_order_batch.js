routerAdd(
  'POST',
  '/backend/v1/count-order/batch',
  (e) => {
    const body = e.requestInfo().body || {}
    const items = body.items

    if (!Array.isArray(items) || items.length === 0) {
      return e.badRequestError('Lista de itens é obrigatória')
    }

    var subareaIds = {}
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      if (!item.product_id) {
        return e.badRequestError('product_id é obrigatório (item ' + (i + 1) + ')')
      }
      if (!item.subarea_id) {
        return e.badRequestError('subarea_id é obrigatório (item ' + (i + 1) + ')')
      }
      if (item.sort_order === undefined || item.sort_order === null) {
        return e.badRequestError('sort_order é obrigatório (item ' + (i + 1) + ')')
      }
      subareaIds[item.subarea_id] = true
    }

    try {
      $app.runInTransaction(function (txApp) {
        var subareaIdList = Object.keys(subareaIds)
        for (var s = 0; s < subareaIdList.length; s++) {
          var subareaId = subareaIdList[s]
          try {
            var existing = txApp.findRecordsByFilter(
              'count_order',
              "subarea_id = '" + subareaId + "'",
              '',
              1000,
              0,
            )
            for (var j = 0; j < existing.length; j++) {
              txApp.delete(existing[j])
            }
          } catch (_) {}
        }

        var col = txApp.findCollectionByNameOrId('count_order')
        for (var k = 0; k < items.length; k++) {
          var newItem = items[k]
          var record = new Record(col)
          record.set('product_id', newItem.product_id)
          record.set('subarea_id', newItem.subarea_id)
          record.set('sort_order', newItem.sort_order)
          txApp.saveNoValidate(record)
        }
      })

      return e.json(200, { success: true })
    } catch (err) {
      return e.json(500, {
        message: 'Erro ao salvar ordem: ' + (err.message || 'erro desconhecido'),
      })
    }
  },
  $apis.requireAuth(),
)
