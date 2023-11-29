const TaskList = async (username) => {
  try {
    console.log(`Fetching tasks for user: ${username}`);
    const response = await fetch(`http://67.205.172.88:5000/api/getUserTasks/${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const tasks = await response.json();
      return tasks;
    } else {
      console.error('Failed to fetch tasks:', response.statusText);
      return [];
    }
  } catch (error) {
    console.error('Error fetching tasks:', error.message);
    return [];
  }
};

const handleDelete = async (taskId, username, setTasks) => {
  try {
    const response = await fetch(`http://67.205.172.88:5000/api/deleteTask/${username}/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`Deletion successful`);
      // Fetch the updated task list and update the state
      const updatedTasks = await TaskList(username);
      setTasks(updatedTasks);
    } else {
      console.error('Failed to delete task:', response.statusText);
    }
  } catch (error) {
    console.error('Error deleting task:', error.message);
  }
};

const handleFinish = async (taskId, username, setTasks) => {
  try {
    const response = await fetch(`http://67.205.172.88:5000/api/finishTask/${username}/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`Finish task successful`);
      // Fetch the updated task list and update the state
      const updatedTasks = await TaskList(username);
      setTasks(updatedTasks);
    } else {
      console.error('Failed to finish task:', response.statusText);
    }
  } catch (error) {
    console.error('Error finishing task:', error.message);
  }
};

const handleEdit = async (taskId, username, newDesc, newIngredient, setTasks, dueDate, effortPoints) => {
  try {
     const response = await fetch(`http://67.205.172.88:5000/api/editTask/${taskId}`, {
        method: 'PUT',
        headers: {
           'Content-Type': 'application/json',
        },
        body: JSON.stringify({
           desc: newDesc,
           ingredient: newIngredient,
           dueDate: dueDate, 
           effortPoints: effortPoints,
        }),
     });

     if (response.ok) {
        console.log(`Task edited successfully`);
        // Fetch the updated task list and update the state
        const updatedTasks = await TaskList(username);
        setTasks(updatedTasks);
     } else {
        console.error('Failed to edit task:', response.statusText);
     }
  } catch (error) {
     console.error('Error editing task:', error.message);
  }
};

export { TaskList, handleDelete, handleFinish, handleEdit };
