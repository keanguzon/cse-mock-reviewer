<script lang="ts">
  import { invalidateAdminCache, watchAdminQuery } from '$lib/admin/client';
  import { onMount } from 'svelte';
  import { adminRequest } from '$lib/admin/client';
  let overview = $state<any>(null);let problem = $state('');let busy = $state(false);
  async function refresh(){busy=true;problem='';try{overview=await adminRequest('api/overview');}catch(e){problem=(e as Error).message;}finally{busy=false;}}
  onMount(refresh);
  $effect(() => watchAdminQuery('api/overview', value => { overview = value; }));
</script>
<h1>Admin overview</h1>
<div class="toolbar"><a class="btn-primary" href="/admin/users">Manage users</a><button class="btn-ghost" onclick={()=>{invalidateAdminCache('api/overview');refresh();}} disabled={busy}>Refresh</button></div>
{#if problem}<p class="error" role="alert">{problem}</p>{/if}
<div class="admin-card" aria-busy={busy}>
{#if !overview}<p>Loading account summary…</p>{:else}<div class="stats"><div><strong>{overview.reviewerCount ?? 0}</strong>Reviewer accounts</div><div><strong>{overview.examCount ?? 0}</strong>Saved exams</div><div><strong>{overview.pausedCount ?? 0}</strong>Paused exams</div><div><strong>{overview.unresolvedDeletionCount ?? 0}</strong>Pending deletions</div></div>{/if}
</div>
<p class="muted">Select a user to manage exam history, recalculate progress, or reset their account data. Every destructive action requires confirmation.</p>
