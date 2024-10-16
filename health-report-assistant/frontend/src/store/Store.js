import { configureStore } from "@reduxjs/toolkit";
import myObjectReducer from "./myObjectReducer";
import anotherObjectReducer from "./anotherObjectReducer";




export const store =  configureStore({
  reducer: {
    object1: myObjectReducer,
    object2: anotherObjectReducer,
  }
});
