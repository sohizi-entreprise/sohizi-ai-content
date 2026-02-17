import { createFileRoute, Outlet } from '@tanstack/react-router'
import ProjectNav from '@/components/layout/project-nav'

export const Route = createFileRoute('/dashboard/projects/$projectId/edit')({
  component: RouteComponent,
})

function RouteComponent() {

    return (
      <div className='h-screen'>
          <Header />
          <div className='flex h-full pt-header'>
              <div className='flex px-4 items-center'>
                  <ProjectNav />
              </div>
  
              <div className='flex-1 h-full'>
                  <Outlet />
              </div>  
          </div>
      </div>
    )
  }


  function Header(){

    return(
        <header className="fixed left-0 right-0 top-0 bg-background/60 backdrop-blur-xl flex items-center justify-between px-4 z-50 h-header">
            <div className=''>
                Sohizi AI
            </div>

            <div className=''>
            User info & credits
            </div>
        </header>

    )
  }