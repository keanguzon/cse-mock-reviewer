<script lang="ts">
 import { onMount } from 'svelte';
 let {title,busy=false,onClose,children}=$props<{title:string;busy?:boolean;onClose:()=>void;children:import('svelte').Snippet}>();let dialog:HTMLDialogElement;
 onMount(()=>{const previous=document.activeElement as HTMLElement|null;dialog.showModal();return()=>previous?.focus();});
</script>
<dialog bind:this={dialog} aria-labelledby="admin-dialog-title" oncancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <h2 id="admin-dialog-title">{title}</h2>{@render children()}
</dialog>
<style>dialog{background:#120c1e;color:#f0e8ff;border:1px solid #817090;border-radius:16px;padding:1.5rem;width:min(540px,calc(100vw - 2rem));max-height:90dvh;overflow:auto}dialog::backdrop{background:#000b}h2{font-size:1.25rem;font-weight:800;margin-bottom:1rem}</style>
