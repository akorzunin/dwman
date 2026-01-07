import { FC, useEffect } from 'react';

interface IModalAvatar {
  img: string;
  isOpen: boolean;
  handleCloseModal: (arg: boolean) => void;
}

export const ModalAvatar: FC<IModalAvatar> = ({
  img,
  isOpen,
  handleCloseModal,
}) => {
  useEffect(() => {
    function closeByEscape(evt: KeyboardEvent) {
      if (evt.key === 'Escape') {
        handleCloseModal(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', closeByEscape);
      return () => {
        document.removeEventListener('keydown', closeByEscape);
      };
    }
  }, [isOpen, handleCloseModal]);
  return (
    <div className={isOpen ? 'modal modal_active' : 'modal'}>
      <img
        src={img}
        alt="User icon"
        className="h-50 cursor-pointer rounded"
        onClick={() => {
          handleCloseModal(false);
        }}
      />
    </div>
  );
};
