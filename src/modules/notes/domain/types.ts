export interface Todo {
  id: string;
  text: string;
  done: boolean;
}
export interface Notes {
  text: string;
  todos: Todo[];
}
