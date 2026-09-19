import { startScreen } from './start-screen';

// Paint the lightweight veil before evaluating the world. A failed game chunk or boot keeps a retry available.
requestAnimationFrame(() => requestAnimationFrame(() => {
  void import('./main').then(game => game.bootReady).catch(error => {
    console.error('Game startup failed', error);
    startScreen.fail();
  });
}));
