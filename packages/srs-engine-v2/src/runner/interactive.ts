import { QuizQuestion } from '../types/quiz.js';

function readKey(): Promise<string> {
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (key: string) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(key);
    });
  });
}

export async function runInteractive(questions: QuizQuestion[]): Promise<void> {
  let score = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\nQuestion ${i + 1} of ${questions.length}`);
    console.log(q.prompt);
    for (const choice of q.choices) {
      console.log(`  ${choice.label}) ${choice.value}`);
    }
    process.stdout.write('Your answer (a/b/c/d): ');

    let answer: string;
    while (true) {
      const key = (await readKey()).toLowerCase();
      if (key === '\u0003') process.exit(); // Ctrl+C
      if (['a', 'b', 'c', 'd'].includes(key)) { answer = key; break; }
    }

    console.log(answer!);

    const selected = q.choices.find(c => c.label === answer)!;
    const correct = q.choices.find(c => c.isCorrect)!;

    if (selected.isCorrect) {
      console.log('Correct!');
      score++;
    } else {
      console.log(`Wrong — correct answer was: ${correct.value}`);
    }
  }

  console.log(`\nScore: ${score} / ${questions.length}`);
}
