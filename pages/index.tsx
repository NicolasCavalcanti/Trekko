import Image from 'next/image'
import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>Trekko - Explore o mundo</title>
      </Head>
      <div className="relative h-screen">
        <Image
          src="/hero.png"
          alt="Montanhas"
          fill
          style={{ objectFit: 'cover' }}
          priority
        />
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-4 text-center">
          <Image src="/logo2.png" alt="Trekko Logo" width={160} height={160} />
          <h1 className="text-white text-4xl md:text-6xl font-bold mt-4">Explore trilhas e aventuras</h1>
          <p className="text-white mt-2 max-w-xl">
            A plataforma para seus trekking, camping, trilha, natureza, outdoor e aventura. Encontre e compartilhe experiências.
          </p>
          <div className="mt-6 flex gap-4">
            <a href="/signup" className="bg-trekko-yellow hover:brightness-95 text-black px-6 py-3 rounded-lg font-semibold">
              Criar conta
            </a>
            <a href="/login" className="border-2 border-trekko-yellow text-white hover:bg-trekko-yellow hover:text-black px-6 py-3 rounded-lg font-semibold">
              Entrar
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
