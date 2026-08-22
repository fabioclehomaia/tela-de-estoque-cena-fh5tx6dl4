onRecordDeleteRequest((e) => {
  // When a product is deleted, first remove every record in related
  // collections that references it through a required relation. Otherwise
  // PocketBase rejects the delete with:
  //   "Failed to delete record. Make sure that the record is not part of a
  //    required relation reference."
  // (inventory_levels, count_order and compras use non-cascading required
  // relations, so they must be cleared here; the cascading ones are cleared
  // too so the behaviour is uniform regardless of the cascade setting.)
  var productId = e.record.id

  var related = [
    ['inventory_levels', 'product_id'],
    ['count_order', 'product_id'],
    ['inventory_counts', 'product_id'],
    ['product_price_history', 'product_id'],
    ['compras', 'product_id'],
  ]

  for (var i = 0; i < related.length; i++) {
    var colName = related[i][0]
    var fieldName = related[i][1]
    try {
      var existing = $app.findRecordsByFilter(
        colName,
        fieldName + " = '" + productId + "'",
        '',
        10000,
        0,
      )
      for (var j = 0; j < existing.length; j++) {
        $app.delete(existing[j])
      }
    } catch (err) {
      // collection might not exist (e.g. fresh instance); ignore
    }
  }

  return e.next()
}, 'products')
