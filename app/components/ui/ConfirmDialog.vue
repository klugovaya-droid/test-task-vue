<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import BaseModal from '~/components/ui/BaseModal.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'danger' | 'primary'
  }>(),
  {
    confirmLabel: 'Подтвердить',
    cancelLabel: 'Отмена',
    tone: 'danger'
  }
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <BaseModal
    :open="open"
    :title="title"
    :description="message"
    role="alertdialog"
    size="sm"
    @close="emit('cancel')"
  >
    <template #footer>
      <AppButton data-autofocus variant="secondary" @click="emit('cancel')">
        {{ cancelLabel }}
      </AppButton>
      <AppButton :variant="tone === 'danger' ? 'danger' : 'primary'" @click="emit('confirm')">
        {{ confirmLabel }}
      </AppButton>
    </template>
  </BaseModal>
</template>
