import React, { useState } from 'react';
import { CreateDropDown } from './dropdown';
import { getPickedIngredient, setPickedIngredient } from './dropdownScript';

const CreateTaskModal = () => {

    const [showDropdown, setShowDropdown] = useState(false);
    const [pickedIngredient, setPickedIngredient] = useState("Pick an Ingredeint");

    return(
        <>
            <div className="modalContainer">
                <div className="modalBox">
                    <p>Create Task</p>
                    <input className="rounded-pill p-2 mb-4" id="NameTask" placeholder="Task name" required />
                    <button type="button" onClick={() => setShowDropdown(!showDropdown)} id="ingredientButton">{pickedIngredient}</button>
                    <button type="button" onClick={undefined} id="ingredientButton">Submit</button>
                    {showDropdown ? <CreateDropDown setIngredientHook={setPickedIngredient}/> : undefined}
                </div>
            </div>
        </>
    );
}

export { CreateTaskModal };
