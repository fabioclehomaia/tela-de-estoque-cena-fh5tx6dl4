onRecordAfterUpdateSuccess((e) => {
  const oldPrice = e.record.original().get('price')
  const newPrice = e.record.get('price')
  if (oldPrice === newPrice) return e.next()

  if (newPrice === null || newPrice === undefined || newPrice === '') return e.next()

  try {
    const historyCol = $app.findCollectionByNameOrId('product_price_history')
    const record = new Record(historyCol)
    record.set('product_id', e.record.id)
    record.set('price', newPrice)
    $app.save(record)
  } catch (err) {
    console.log('Failed to create price history for product ' + e.record.id, err.message)
  }
  return e.next()
}, 'products')
