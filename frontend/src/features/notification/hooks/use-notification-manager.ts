import { useEffect } from 'react';


export const useNotificationManager = () => {
  // Get count of tasks that are not 'completed' or 'failed'
  const activeTaskCount = 2 // useTaskStore((state) => state.getActiveTaskCount());
  const updateTask = () => {} // useTaskStore((state) => state.updateTask);
  const hasActiveTasks = activeTaskCount > 0

  useEffect(() => {

    if (!hasActiveTasks) return;

    const eventSource = new EventSource('/api/sse/notifications');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      //updateTask(data.taskId, data); // Update global state
    };

    eventSource.onerror = () => {
      // Handle reconnect logic
      eventSource?.close();
    };

    // Cleanup function runs when activeTaskCount becomes 0 (or component unmounts)
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [hasActiveTasks]); // Re-run effect when active task count changes
};