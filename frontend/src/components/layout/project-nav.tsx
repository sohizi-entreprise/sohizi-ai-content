import { IconFileDescription, IconLayoutGrid, IconSettings, IconUsersGroup } from '@tabler/icons-react';
import { VerticalFloatingDock } from '../ui/vertical-floating-dock';

const links = [
    {
      title: "Script",
      icon: (
        <IconFileDescription className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "/dashboard/projects/$projectId/script",
    },
 
    {
      title: "Elements",
      icon: (
        <IconUsersGroup className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "/dashboard/projects/$projectId/elements",
    },
    {
      title: "Storyboard",
      icon: (
        <IconLayoutGrid className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "/dashboard/projects/$projectId/storyboard",
    },
    {
      title: "Settings",
      icon: (
        <IconSettings className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: "/dashboard/projects/$projectId/settings",
    }
  ];

export default function ProjectNav() {
  return (
    <div>
        <VerticalFloatingDock
        items={links}
      />
    </div>
  )
}
