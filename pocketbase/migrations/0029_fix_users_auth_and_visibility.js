migrate(
  (app) => {
    // 1. Garantir que a regra de update e create na coleção de usuários permita admins alterarem usuários
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || id = @request.auth.id)"
    users.deleteRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    // Garantir política de senha mínima de 6 caracteres
    var pwdField = users.fields.getByName('password')
    if (pwdField) {
      pwdField.min = 6
    }

    app.save(users)

    // 2. Garantir que todos os usuários existentes tenham emailVisibility = true
    const allUsers = app.findRecordsByFilter('users', '', '', 0, 0)
    for (let i = 0; i < allUsers.length; i++) {
      const u = allUsers[i]
      u.set('emailVisibility', true)
      app.save(u)
    }
  },
  (app) => {},
)
