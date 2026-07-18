import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  deleteAdminSkillMutationOptions,
  listAdminSkillsQueryOptions,
} from '../query-mutation'
import type { AdminSkill } from '../types'
import { SkillFormDialog } from './skill-form-dialog'

export function SkillsPage() {
  const { data: skills = [], isLoading, error } = useQuery(listAdminSkillsQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminSkill | null>(null)

  const deleteMutation = useMutation(deleteAdminSkillMutationOptions())

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (skill: AdminSkill) => {
    setEditing(skill)
    setDialogOpen(true)
  }

  const handleDelete = (skill: AdminSkill) => {
    if (!window.confirm(`Delete skill “${skill.name}”? This cannot be undone.`)) return
    deleteMutation.mutate(skill.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
          <p className="text-sm text-muted-foreground">
            Platform catalog skills. Published + public skills are available to agents.
          </p>
        </div>
        <Button onClick={openCreate}>Add skill</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading skills…</p> : null}
      {error ? <p className="text-sm text-destructive">Failed to load skills</p> : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.map((skill) => (
              <TableRow key={skill.id}>
                <TableCell>
                  <div className="font-medium">{skill.name}</div>
                  <div className="max-w-xs truncate text-xs text-muted-foreground">
                    {skill.description}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={skill.status === 'published' ? 'default' : 'secondary'}>
                    {skill.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{skill.visibility}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {skill.categories.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      skill.categories.map((category) => (
                        <Badge key={category.id} variant="secondary">
                          {category.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(skill)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(skill)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && skills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No skills yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <SkillFormDialog open={dialogOpen} onOpenChange={setDialogOpen} skill={editing} />
    </div>
  )
}
