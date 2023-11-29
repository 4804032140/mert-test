import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CreateDropDown } from './dropdown';
import { TaskList } from './MainPageScript';

const CreateTaskModal = ({ username, setTasks, setShowModalTask }) => {
    const urlBase = 'http://67.205.172.88:5000';

    const [showDropdown, setShowDropdown] = useState(false);
    const [pickedIngredient, setPickedIngredient] = useState("Pick an Ingredient");
    const [dueDate, setDueDate] = useState(null);
    const [effortPoints, setEffortPoints] = useState("");
    const [taskName, setTaskName] = useState("");
    const [ingredientNames, setIngredientNames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const effortPointOptions = [1, 2, 3, 4, 5, 6];

    const fetchIngredientNames = async () => {
        if (ingredientNames.length === 0) {
            try {
                const response = await fetch(`${urlBase}/api/getIngredientNames`);
                if (response.ok) {
                    const data = await response.json();
                    setIngredientNames(data);
                } else {
                    console.error('Failed to fetch ingredient names:', response.statusText);
                }
            } catch (error) {
                console.error('Error fetching ingredient names:', error.message);
            }
        }
    };

    // Fetch ingredient names when the component is first rendered
    fetchIngredientNames();

    const handleIngredientSelection = (ingredient) => {
        setPickedIngredient(ingredient);
        setShowDropdown(false);
    };

    const handleSubmit = async () => {
        console.log('Handling submit...');

// Check if any of the required fields are not filled out
if (!taskName || pickedIngredient === 'Pick an Ingredient' || !dueDate || !effortPoints) {
    const errorMessage = 'Please fill out all required fields.';
    console.error(errorMessage);
    setError(errorMessage);
    return;
}

        setLoading(true);
        try {
            console.log('Sending POST request...');
            const response = await fetch(`${urlBase}/api/createTask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    desc: taskName,
                    ingredient: pickedIngredient,
                    dueDate: dueDate,
                    effortPoints: effortPoints,
                }),
            });
            if (response.ok) {
                console.log('Task created successfully');
                // Fetch the updated task list and update the state
                const updatedTasks = await TaskList(username);
                setTasks(updatedTasks);
                setShowModalTask(false);

            } else {
                console.error('Failed to create task:', response.statusText);
            }
        } catch (error) {
            console.error('Error creating task:', error.message);
        } finally {
            setLoading(false);
        }
        console.log('Submit complete.');
        // Reset the form if needed
        setTaskName('');
        setPickedIngredient('Pick an Ingredient');
        setDueDate(null);
        setEffortPoints('');
    };

    return (
        <>
            <div className="modalContainer">
                <div className="modalBox">
                    <p>Create Task</p>
                    <input
                        className="rounded-pill p-2 mb-4"
                        id="NameTask"
                        placeholder="Task name"
                        required
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                    />
                    <div className="datepicker-container">
                        <DatePicker
                            selected={dueDate}
                            onChange={(date) => setDueDate(date)}
                            customInput={<DateButton />}
                            dateFormat="MMMM d, yyyy"
                            popperPlacement="bottom-start"
                        />
                    </div>
                    <input
                        className="rounded-pill p-2 mb-4"
                        id="EffortPoints"
                        placeholder="Effort"
                        required
                        onChange={(e) => setEffortPoints(e.target.value)}
                        type='number'
                    />
                    <button
                        type="button"
                        onClick={() => setShowDropdown(!showDropdown)}
                        id="ingredientButton"
                    >
                        {pickedIngredient}
                    </button>
                    <button type="button" onClick={handleSubmit} id="submitButton" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit'}
                    </button>
                    {showDropdown ? <CreateDropDown setIngredientHook={handleIngredientSelection} ingredientNames={ingredientNames} /> : undefined}
                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        </>
    );

};

const DateButton = ({ value, onClick }) => (
    <div className="date-button-container">
        <button type="button" className="date-button" onClick={onClick}>
            {value || 'Select Due Date'}
        </button>
    </div>
);
export { CreateTaskModal };
