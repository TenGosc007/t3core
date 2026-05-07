import readline from "readline";

// terminal communication interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export const UserInput = (query: string) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

export const closeInput = () => {
  rl.close();
};
