<script lang="ts">
  import '../app.css';
  const { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <title>Civil Service Mock Exam</title>
</svelte:head>

<main class="container slide-up">
  {@render children()}
</main>
