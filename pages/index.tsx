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
          layout="fill"
          objectFit="cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
          <Image src="/logo2.png" alt="Trekko Logo" width={200} height={200} />
          <h1 className="text-white text-4xl md:text-6xl font-bold mt-4">Explore trilhas e aventuras</h1>
          <p className="text-white mt-2 max-w-xl text-center">
            A plataforma para seus trekking, camping, trilha, natureza, outdoor e aventura. Encontre e compartilhe experiências.
          </p>
          <div className="mt-6 flex space-x-4">
            <a href="/signup" className="bg-trekko-yellow hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-semibold">
              Criar conta
            </a>
            <a href="/login" className="bg-transparent border-2 border-trekko-yellow hover:bg-trekko-yellow text-trekko-yellow hover:text-white px-6 py-3 rounded-lg font-semibold">
              Entrar
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
