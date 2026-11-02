import './bridges';
import { bootstrapIsland } from '../renderer/island/bootstrap';
import { presentation } from '../shared/renderer/presentation';
import { REMINDERS } from '../modules/reminders/renderer/data';

// Compatibility surface for the historical promo scene scripts. Never packaged with the app.
const context = bootstrapIsland();
Object.assign(window, context, presentation, {
  REMINDERS,
  showSlide(index: number) {
    const slides = [...context.$$('.info-slide')].filter(
      (slide) => !slide.hidden && !slide.classList.contains('off'),
    );
    slides.forEach((slide, i) => slide.classList.toggle('on', i === index));
  },
});
