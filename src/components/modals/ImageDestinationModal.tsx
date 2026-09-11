import { App } from 'obsidian'

import { EagleBridge } from '../../core/image/eagle-bridge'
import {
  RESOLVED_IMAGE_DESTINATION_LABELS,
  ResolvedImageDestination,
} from '../../core/image/image-destination'
import { ReactModal } from '../common/ReactModal'

type ImageDestinationModalProps = {
  bridge: EagleBridge | null
  onChoose: (destination: ResolvedImageDestination) => void
  onClose: () => void
}

/** Asks where the next generated image should be stored. Resolves null on dismiss. */
export class ImageDestinationModal extends ReactModal<ImageDestinationModalProps> {
  private choice: ResolvedImageDestination | null = null
  private resolveChoice:
    | ((value: ResolvedImageDestination | null) => void)
    | null = null

  constructor(app: App, bridge: EagleBridge | null) {
    super({
      app,
      Component: ImageDestinationModalComponent,
      props: {
        bridge,
        onChoose: (destination) => {
          this.choice = destination
        },
      },
      options: { title: 'Where should the generated image go?' },
    })
  }

  choose(): Promise<ResolvedImageDestination | null> {
    this.open()
    return new Promise((resolve) => {
      this.resolveChoice = resolve
    })
  }

  onClose(): void {
    super.onClose()
    this.resolveChoice?.(this.choice)
    this.resolveChoice = null
  }
}

function ImageDestinationModalComponent({
  bridge,
  onChoose,
  onClose,
}: ImageDestinationModalProps) {
  const cloudName = bridge?.getActiveCloudProvider()
    ? bridge.getActiveCloudProviderName()
    : null
  const pick = (destination: ResolvedImageDestination) => {
    onChoose(destination)
    onClose()
  }
  return (
    <div>
      <div className="modal-button-container">
        <button
          className="mod-cta"
          disabled={!bridge}
          onClick={() => pick('eagle')}
        >
          {RESOLVED_IMAGE_DESTINATION_LABELS.eagle}
        </button>
        <button onClick={() => pick('vault')}>
          {RESOLVED_IMAGE_DESTINATION_LABELS.vault}
        </button>
        <button disabled={!cloudName} onClick={() => pick('cloud')}>
          {cloudName
            ? `${cloudName} (cloud)`
            : RESOLVED_IMAGE_DESTINATION_LABELS.cloud}
        </button>
      </div>
      {!bridge && (
        <div className="setting-item-description">
          Install and enable the CMDS Eagle plugin to use Eagle or cloud
          storage.
        </div>
      )}
    </div>
  )
}
