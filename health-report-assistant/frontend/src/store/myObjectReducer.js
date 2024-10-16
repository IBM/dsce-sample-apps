import lodash from "lodash";
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  myObject: null,
};

const myObjectSlice = createSlice({
  name: "myObject",
  initialState,
  reducers: {
    setMyObject: (state, action) => {
      state.myObject = action.payload.myObject;
    },
    deleteMyObject: (state, action) => {
      state.myObject = null;
    }
  }
})

// Action creators are generated for each case reducer function
export const { setMyObject, deleteMyObject } = myObjectSlice.actions;
// Export reducer
export default myObjectSlice.reducer;

//Export selectors
const selectMyObject = (state) => {
  return state.object1.myObject;
};

export { selectMyObject};
