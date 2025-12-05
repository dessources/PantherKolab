import {
  DefaultStylePanel,
  DefaultStylePanelContent,
  TLUiStylePanelProps,
} from "tldraw";
import styles from "./WhiteboardCanvas.module.css";
export default function CustomStylePanel(props: TLUiStylePanelProps) {
  return (
    <div className={styles.customStylePanel}>
      <DefaultStylePanel {...props}>
        <DefaultStylePanelContent />
      </DefaultStylePanel>
    </div>
  );
}
