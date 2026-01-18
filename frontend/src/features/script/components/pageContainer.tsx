import React from 'react'

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className='my-8 border container mx-auto bg-white text-gray-600 font-courier max-w-[794px] px-8 pt-10 pb-[200px]'>
        {children}
    </div>
  )
}
