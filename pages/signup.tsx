export default function Signup() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Criar Conta</h1>
      <form className="space-y-4 w-full max-w-sm">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">Nome</label>
          <input id="name" type="text" className="mt-1 p-2 border w-full" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" type="email" className="mt-1 p-2 border w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Senha</label>
          <input id="password" type="password" className="mt-1 p-2 border w-full" />
        </div>
        <button type="submit" className="w-full bg-trekko-yellow text-black hover:brightness-95 py-2 px-4 rounded">
          Criar Conta
        </button>
      </form>
    </div>
  )
}
