import { AnySelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';

/** Qualquer interação de componente que carrega um customId roteável. */
export type ComponentInteraction =
  | ButtonInteraction
  | AnySelectMenuInteraction
  | ModalSubmitInteraction;

/**
 * Handler de componente (botão, menu de seleção ou modal).
 *
 * O roteamento é feito pelo prefixo do customId antes do ':'. Ex.: um componente
 * com `id: 'embed'` recebe todas as interações de customId `embed:send`, `embed:edit_visual`, etc.
 */
export interface Component {
  /** Prefixo do customId (parte antes de ':') tratado por este handler. */
  id: string;
  execute(interaction: ComponentInteraction): Promise<void> | void;
}
