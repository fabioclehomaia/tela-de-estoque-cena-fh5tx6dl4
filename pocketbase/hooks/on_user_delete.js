onRecordDeleteRequest((e) => {
  // Impede que o usuário exclua a si mesmo
  var currentAuth = e.auth
  if (currentAuth && currentAuth.id === e.record.id) {
    throw new BadRequestError('Você não pode excluir sua própria conta.')
  }

  var userId = e.record.id

  // Limpar todos os registros vinculados ao usuário antes de deletar
  // 1. inventory_counts vinculados a user_id
  try {
    var counts = $app.findRecordsByFilter(
      'inventory_counts',
      "user_id = '" + userId + "'",
      '',
      10000,
      0,
    )
    for (var i = 0; i < counts.length; i++) {
      $app.delete(counts[i])
    }
  } catch (err) {
    // collection pode não ter registros ou falhar
  }

  // 2. Se houver outras coleções ou tabelas futuras com referência direta
  var related = [['inventory_counts', 'user_id']]

  for (var k = 0; k < related.length; k++) {
    var colName = related[k][0]
    var fieldName = related[k][1]
    if (colName === 'inventory_counts') continue // já limpo acima
    try {
      var existing = $app.findRecordsByFilter(
        colName,
        fieldName + " = '" + userId + "'",
        '',
        10000,
        0,
      )
      for (var j = 0; j < existing.length; j++) {
        $app.delete(existing[j])
      }
    } catch (err2) {
      // ignore
    }
  }

  return e.next()
}, 'users')
