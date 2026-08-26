routerAdd(
  'POST',
  '/backend/v1/users/reset-password',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.unauthorizedError('Autenticação necessária')
    }

    const currentRole = auth.get('role')
    if (currentRole !== 'admin' && currentRole !== 'manager') {
      return e.forbiddenError(
        'Acesso negado: apenas administradores ou gerentes podem resetar senhas',
      )
    }

    const body = e.requestInfo().body || {}
    const userId = body.userId
    const password = body.password
    const passwordConfirm = body.passwordConfirm

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return e.badRequestError('userId é obrigatório', {
        userId: { message: 'ID do usuário é obrigatório' },
      })
    }

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return e.badRequestError('A senha deve ter no mínimo 6 caracteres', {
        password: { message: 'A senha deve ter no mínimo 6 dígitos/caracteres' },
      })
    }

    if (
      !passwordConfirm ||
      typeof passwordConfirm !== 'string' ||
      password.trim() !== passwordConfirm.trim()
    ) {
      return e.badRequestError('As senhas não coincidem', {
        passwordConfirm: { message: 'As senhas não coincidem' },
      })
    }

    try {
      const userRecord = $app.findRecordById('users', userId.trim())
      userRecord.setPassword(password.trim())
      $app.save(userRecord)

      return e.json(200, {
        success: true,
        message: 'Senha alterada com sucesso',
      })
    } catch (err) {
      return e.json(err.status || 500, {
        message:
          'Erro ao redefinir senha: ' + (err.message || 'usuário não encontrado ou erro interno'),
      })
    }
  },
  $apis.requireAuth(),
)
