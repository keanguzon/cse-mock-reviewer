<script lang="ts">
  // Blur-in text animation — each character fades in from blur, staggered
  let { text, delay = 0, class: className = '' }: { text: string; delay?: number; class?: string } = $props();
  
  const chars = text.split('');
</script>

<span class="blur-text {className}" aria-label={text}>
  {#each chars as char, i}
    <span
      class="blur-char"
      style="animation-delay: {delay + i * 28}ms"
    >{char === ' ' ? '\u00A0' : char}</span>
  {/each}
</span>

<style>
  .blur-text {
    display: inline;
  }

  .blur-char {
    display: inline-block;
    opacity: 0;
    filter: blur(12px);
    transform: translateY(6px);
    animation: blurIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes blurIn {
    to {
      opacity: 1;
      filter: blur(0px);
      transform: translateY(0);
    }
  }
</style>
