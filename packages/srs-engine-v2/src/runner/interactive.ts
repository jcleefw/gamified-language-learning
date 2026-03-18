import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { QuizQuestion } from '../types/quiz.js';

export async function runInteractive(questions: QuizQuestion[]): Promise<void> {
  const rl = createInterface({ input, output });
  let score = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\nQuestion ${i + 1} of ${questions.length}`);
    console.log(q.prompt);
    for (const choice of q.choices) {
      console.log(`  ${choice.label}) ${choice.value}`);
    }

    let answer: string;
    while (true) {
      answer = (await rl.question('Your answer (a/b/c/d): ')).trim().toLowerCase();
      if (['a', 'b', 'c', 'd'].includes(answer)) break;
      console.log('Please enter a, b, c, or d.');
    }

    const selected = q.choices.find(c => c.label === answer)!;
    const correct = q.choices.find(c => c.isCorrect)!;

    if (selected.isCorrect) {
      console.log('Correct!');
      score++;
    } else {
      console.log(`Wrong — correct answer was: ${correct.value}`);
    }
  }

  rl.close();
  console.log(`\nScore: ${score} / ${questions.length}`);
}
