<template>
  <footer class="mkt__footer">
    <div>
      <strong class="mkt__footer-brand">
        <span class="mkt__brand-mark" aria-hidden="true">
          <img src="/grids_logo.png" alt="" />
        </span>
        <span class="mkt__brand-word">grids</span>
      </strong>
      <p>Showcase simplified. Your page, your work, your success.</p>
    </div>
    <div class="mkt__footer-links">
      <div class="mkt__footer-col">
        <h4>Product</h4>
        <router-link to="/pricing">Pricing</router-link>
        <a href="https://discord.com/channels/1452087541548191940/1464413220549955768" target="_blank" rel="noopener noreferrer">What's New</a>
      </div>
      <div class="mkt__footer-col">
        <h4>Company</h4>
        <router-link to="/privacy">Privacy Policy</router-link>
        <router-link to="/terms">Terms</router-link>
        <a href="https://discord.gg/DBscN5NUN6" target="_blank" rel="noopener noreferrer">Discord Server</a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
</script>

<style scoped>
.mkt__footer {
  border-top: 1px solid rgba(255, 255, 255, .06);
  padding: 52px var(--mkt-section-x) 32px;
  width: 100%;
  max-width: var(--mkt-chrome-max);
  margin: 64px auto 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 40px;
  text-align: left;
}
.mkt__footer-links {
  display: flex;
  gap: 64px;
}
.mkt__footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  letter-spacing: -0.04em;
  margin-bottom: 10px;
}
.mkt__brand-word {
  font-family: var(--mkt-font-brand);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: lowercase;
}
.mkt__brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.mkt__brand-mark img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
  display: block;
}
.mkt__footer p {
  color: rgba(255, 255, 255, .5);
  max-width: 280px;
}
.mkt__footer-col h4 {
  margin: 0 0 14px;
  font: 600 12px/1 var(--mkt-font-sans);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .45);
}
.mkt__footer-col a {
  display: block;
  color: rgba(255, 255, 255, .75);
  margin-bottom: 10px;
  text-decoration: none;
}
.mkt__footer-col a:hover {
  color: var(--mkt-fg-1);
}

@media (max-width: 800px) {
  .mkt__footer {
    flex-direction: column;
    padding-left: 14px;
    padding-right: 14px;
  }
  .mkt__footer-links { gap: 40px; }
}
</style>
