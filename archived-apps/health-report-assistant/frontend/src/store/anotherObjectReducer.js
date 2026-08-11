import lodash from "lodash";
import { createSlice } from "@reduxjs/toolkit";


const initialState = {
  anotherObjectArr: []
};

const anotherObjectArrSlice = createSlice({
  name: "anotherObjectArr",
  initialState,
  reducers: {
    addAnotherObject: (state, action) => {
      state.anotherObjectArr = [
        ...state.anotherObjectArr, 
        action.payload.anotherObject
      ];
    }
  }
})

// Action creators are generated for each case reducer function
export const { addAnotherObject } = anotherObjectArrSlice.actions;
// Export reducer
export default anotherObjectArrSlice.reducer;

//Export selectors
const selectAnotherObjectArr = (state) => {
  return state.object2.anotherObjectArr;
};

export { selectAnotherObjectArr};
