<template>
  <section class="home-placeholder">
    <p class="home-placeholder__eyebrow">Личные заметки</p>
    <h1 class="home-placeholder__title">Заметки</h1>
    <p class="home-placeholder__text">
      Скоро здесь появится список заметок и их задач.
    </p>
  </section>
</template>

<style scoped lang="scss">
.home-placeholder {
  max-width: 640px;
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);

  &__eyebrow {
    margin: 0 0 var(--space-3);
    color: var(--color-primary);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__title {
    margin: 0 0 var(--space-4);
    font-size: clamp(2rem, 6vw, 3.5rem);
    line-height: 1;
  }

  &__text {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 1.0625rem;
    line-height: 1.6;
  }
}
</style>
