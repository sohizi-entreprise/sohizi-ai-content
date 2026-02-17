import React from 'react'

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className='border container mx-auto bg-white text-gray-600 font-courier max-w-[794px] min-h-[1122px] px-8 py-10'>
        {children}
    </div>
  )
}
