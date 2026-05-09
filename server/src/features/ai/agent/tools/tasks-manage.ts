import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { v4 as uuidv4 } from 'uuid';
import { failure, success } from "./utils";
import { TodoItem } from "@/type";

const addTodoSchema = z.object({
    action: z.literal('add').describe('Add new tasks to the todo list.'),
    tasks: z.array(z.string()).describe('The tasks to add to the todo list.'),
})

const completeTodoSchema = z.object({
    action: z.literal('update').describe('Update the status of a task after its completion.'),
    taskId: z.string().describe('The id of the task to complete.'),
    status: z.enum(['pending', 'in_progress', 'done']).describe('The status of the task.'),
})

const deleteTodoSchema = z.object({
    action: z.literal('delete').describe('Remove any obsolete task from the todo list.'),
    taskId: z.string().describe('The id of the task to delete.'),
})

const listTodosSchema = z.object({
    action: z.literal('list').describe('List all tasks in the todo list.'),
})

const clearTodosSchema = z.object({
    action: z.literal('clear').describe('Clear all tasks from the todo list after they are all completed.'),
})

const manageTodoListInputSchema = z.discriminatedUnion('action', [addTodoSchema, completeTodoSchema, deleteTodoSchema, listTodosSchema, clearTodosSchema]);

export const manageTodoListTool = buildBaseTool({
    name: "manageTasks",
    description: getDescription(),
    inputSchema: z.object({
        manageTask: manageTodoListInputSchema,
    }),
    execute: async(action, {state}) => {
        const input = action.manageTask;
        switch (input.action) {
            case 'add': {
                const newTodos = input.tasks.map((task) => ({
                    id: `task-${uuidv4().slice(0, 8)}`,
                    task,
                    status: 'pending' as const,
                }))
                state.todos.push(...newTodos);
                return success(formatTodoList(state.todos));
            }
            case 'update':{
                const todo = state.todos.find((todo) => todo.id === input.taskId);
                if(!todo){
                    return failure(`Task with id ${input.taskId} not found. Check the task id by listing the current tasks and try again.`);
                }
                todo.status = input.status;
                return success(formatTodoList(state.todos));
            }
            case 'delete':{
                const todo = state.todos.find((todo) => todo.id === input.taskId);
                if(!todo){
                    return failure(`Task with id ${input.taskId} not found. Check the task id by listing the current tasks and try again.`);
                }
                state.todos = state.todos.filter((todo) => todo.id !== input.taskId);
                return success(formatTodoList(state.todos));
            }
            case 'list':{
                if(state.todos.length === 0){
                    return success('There are no tasks in the current session. You can create one if necessary.');
                }
                return success(formatTodoList(state.todos));
            }
            case 'clear':{
                const ongoingTasks = state.todos.filter((todo) => todo.status === 'in_progress' || todo.status === 'pending');
                if(ongoingTasks.length > 0){
                    const headerText = `You can't clear the todo list yet. Because there are ${ongoingTasks.length} ongoing tasks. You must complete all the tasks before clearing. If a task is obsolete, you can delete it using the 'delete' action. \nThe ongoing tasks are: \n---\n\n`
                    const ongoingTasksText = ongoingTasks.map((todo) => ` ${todo.id} - ${todo.task} : [${todo.status}]`).join('\n');
                    const finalText = headerText + ongoingTasksText;
                    return failure(finalText);
                }
                state.todos = [];
                return success('All tasks have been cleared.');
            }
            default:
                return failure('An unknown error occurred');
        }
    },
})

function getDescription() {
    return `
Maintains your internal step-by-step plan for the current session. Use this tool immediately after receiving a multi-step task (3+ steps) from the user to break it down into steps.
Update it continuously as tasks are completed, or when new sub-tasks are discovered. You must check and update this list before and after delegating work to sub-agents to ensure you never lose track of the overall goal.
'add' : Add new tasks to the todo list.
'update' : Update the status of a task by its id.
'delete' : Remove any obsolete task from the todo list.
'list' : List all tasks in the todo list.
`
}

function formatTodoList(todos: TodoItem[]): string {
    const totalTasks = todos.length;
    const pendingTasks = todos.filter((todo) => todo.status === 'pending').length;
    const inProgressTasks = todos.filter((todo) => todo.status === 'in_progress').length;
    const doneTasks = todos.filter((todo) => todo.status === 'done').length;
    const headerText = `List of tasks your are working on:\n---\n\n`
    const allDone = doneTasks === totalTasks;
    let summary = `Summary:\n---\nYour overall progress: ${doneTasks}/${totalTasks} tasks completed. ${pendingTasks} tasks pending, ${inProgressTasks} tasks in progress.`;
    if(allDone){
        summary = `Summary:\n---\nAll tasks are completed.`;
    }else if(pendingTasks === totalTasks){
        summary = `Summary:\n---\nAll tasks are pending. Start working on the first task. Update its status to 'in_progress'`;
    }
    const taskList = todos.map((todo, index) => ` ${index + 1}. ${todo.id} - ${todo.task} : [${todo.status}]`).join('\n');
    const finalText = headerText + taskList + summary
    return finalText;
}