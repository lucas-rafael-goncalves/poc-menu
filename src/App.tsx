import {
  autoUpdate,
  offset,
  safePolygon,
  shift,
  useFloating,
  useHover,
  useInteractions,
  useMergeRefs,
  type UseFloatingReturn,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { Slot } from '@radix-ui/react-slot';
import { AnimatePresence, motion } from 'motion/react';
import {
  Children,
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  use,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PropsWithChildren,
  type Ref,
  type RefObject,
} from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { useWindowSize } from 'react-use';
import useMeasure from 'react-use-measure';
import { twMerge } from 'tailwind-merge';

type DropdownContextStore = {
  floating: UseFloatingReturn;
  interactions: UseInteractionsReturn;
};

function useDropdownContext() {
  const dropdownContext = use(DropdownContext);

  if (!dropdownContext)
    throw new Error(
      'useDropdownContext hook must be used within DropdownProvider.',
    );

  return dropdownContext;
}

const DropdownContext = createContext<DropdownContextStore | null>(null);

function Dropdown(
  props: PropsWithChildren<{ headerRef: RefObject<HTMLElement | null> }>,
) {
  const { headerRef, children } = props;

  const [isOpen, setIsOpen] = useState(false);

  const floating = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      shift({ padding: 20 }),
      offset(function (data) {
        if (!headerRef.current) return 0;
        return headerRef.current.getBoundingClientRect().bottom - data.y;
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(floating.context, {
    handleClose: safePolygon(),
  });

  const interactions = useInteractions([hover]);

  return (
    <DropdownContext.Provider value={{ floating, interactions }}>
      {children}
    </DropdownContext.Provider>
  );
}

function DropdownContent(props: PropsWithChildren) {
  const { children } = props;

  const {
    floating: { context, floatingStyles, refs },
    interactions: { getFloatingProps },
  } = useDropdownContext();

  if (!context.open) return null;

  return (
    <div {...getFloatingProps()} ref={refs.setFloating} style={floatingStyles}>
      {children}
    </div>
  );
}

function DropdownTrigger(props: PropsWithChildren) {
  const { children } = props;

  const {
    floating: { refs },
    interactions: { getReferenceProps },
  } = useDropdownContext();

  return (
    <Slot {...getReferenceProps()} ref={refs.setReference}>
      {children}
    </Slot>
  );
}

function MenuContainer(props: PropsWithChildren) {
  const { children } = props;

  const [hasCalculatedColumns, setHasCalculatedColumns] = useState(false);

  const [columns, setColumns] = useState<Array<Array<number>> | null>(null);

  const childrenRefs = useRef<Array<HTMLElement>>([]);

  const elementRef = useRef<HTMLDivElement | null>(null);

  const [measureRef, { top }] = useMeasure();

  const { height, width } = useWindowSize();

  const maxHeight = 0.8 * (height - top);

  const ref = useMergeRefs([elementRef, measureRef]);

  useLayoutEffect(() => {
    if (!childrenRefs.current || !top) return;

    let columnHeight: number = 0,
      currentColumn = 0;

    setColumns(
      childrenRefs.current.reduce<Array<Array<number>>>((acc, cur, idx) => {
        const { height } = cur.getBoundingClientRect();

        if (height + columnHeight <= maxHeight) columnHeight += height;
        else {
          columnHeight = height;
          currentColumn++;
        }

        acc[currentColumn] = (acc[currentColumn] || []).concat(idx);

        return acc;
      }, []),
    );

    setHasCalculatedColumns(true);

    return () => {
      setColumns([]);
      setHasCalculatedColumns(false);
    };
  }, [children, maxHeight, top]);

  const menuItems = Children.map(
    children,
    (child, idx) =>
      isValidElement<{ ref: Ref<HTMLElement> }>(child) &&
      cloneElement(child, {
        ref: (ref) => {
          if (ref) {
            childrenRefs.current[idx] = ref;
          }
        },
      }),
  );

  return (
    <div
      ref={ref}
      style={
        {
          '--max-height': `${maxHeight}px`,
          '--max-width': `${width - 40}px`,
        } as CSSProperties
      }
      className={twMerge(
        'max-h-(--max-height) max-w-(--max-width) bg-blue-300',
        hasCalculatedColumns
          ? 'flex flex-wrap overflow-y-auto gap-y-20'
          : 'opacity-0',
      )}
    >
      {!hasCalculatedColumns
        ? menuItems
        : columns?.map((column, idx) => (
            <MenuColumn key={idx}>
              {menuItems?.filter((_, idx) => column.includes(idx))}
            </MenuColumn>
          ))}
    </div>
  );
}

export function MenuColumn(props: ComponentProps<'ul'>) {
  return <ul {...props} />;
}

function MenuItem(props: ComponentProps<'li'> & { items?: Array<number> }) {
  const { children, className, items, ...rootProps } = props;

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Fragment>
      <li
        {...rootProps}
        className={twMerge('p-2.5 min-w-[180px] max-w-[260px]', className)}
      >
        <span
          {...(items?.length && {
            onClick: () => setIsOpen((prevIsOpen) => !prevIsOpen),
          })}
          className={twMerge(
            'cursor-pointer select-none',
            items?.length && 'flex items-center gap-2.5',
          )}
        >
          {children}
          {items?.length ? (
            <FaChevronDown
              className={twMerge(
                'text-xs transition-transform',
                isOpen && '-scale-100',
              )}
            />
          ) : null}
        </span>
      </li>
      {items?.length ? (
        <AnimatePresence>
          {isOpen ? (
            <motion.ul
              className="overflow-hidden"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
            >
              {items.map((_, idx) => (
                <MenuItem key={idx}>Sub-item {idx + 1}</MenuItem>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      ) : null}
    </Fragment>
  );
}

function AppBar(props: { align: Align; itemsCount: number }) {
  const headerRef = useRef<HTMLElement>(null);

  return (
    <header
      className={twMerge(
        'h-[60px] bg-amber-300 shadow-2xs flex items-center gap-7 px-5',
        props.align === 'left' && 'justify-start',
        props.align === 'center' && 'justify-center',
        props.align === 'right' && 'justify-end',
      )}
      ref={headerRef}
    >
      {Array.from({ length: 3 }).map((_, idx) => (
        <Dropdown key={idx} headerRef={headerRef}>
          <DropdownTrigger>
            <h1 className="text-xl font-bold cursor-pointer">Menu {idx + 1}</h1>
          </DropdownTrigger>
          <DropdownContent>
            <MenuContainer>
              {Array.from({ length: props.itemsCount }).map((_, idx) => (
                <MenuItem
                  className="font-bold"
                  key={idx}
                  {...((idx + 1) % 5 === 0 && {
                    items: Array.from({ length: 8 }).map((_, idx) => idx),
                  })}
                >
                  Item {idx + 1}
                </MenuItem>
              ))}
            </MenuContainer>
          </DropdownContent>
        </Dropdown>
      ))}
    </header>
  );
}

function Button(props: ComponentProps<'button'>) {
  const { className, ...rootProps } = props;

  return (
    <button
      {...rootProps}
      className={twMerge(
        'py-0 px-2.5 bg-black cursor-pointer text-white',
        className,
      )}
    />
  );
}

type Align = 'left' | 'center' | 'right';

export default function App() {
  const [itemsCount, setItemsCount] = useState(1);

  const [align, setAlign] = useState<Align>('left');

  return (
    <div className="h-dvh flex flex-col">
      <div className="flex items-center gap-2.5 p-2.5">
        <Button
          onClick={() => setItemsCount((prevItemsCount) => prevItemsCount - 1)}
        >
          Remover item
        </Button>
        <Button
          onClick={() => setItemsCount((prevItemsCount) => prevItemsCount + 1)}
        >
          Adicionar item
        </Button>
      </div>
      <div className="flex items-center gap-2.5 p-2.5">
        <Button onClick={() => setAlign('left')}>Alinhar esquerda</Button>
        <Button onClick={() => setAlign('center')}>Centralizar</Button>
        <Button onClick={() => setAlign('right')}>Alinhar direita</Button>
      </div>
      <h1 className="text-xl font-bold p-2.5">
        Quantidade de itens no menu:{' '}
        <input
          className="border-b w-10"
          value={itemsCount}
          onChange={(evt) => {
            setItemsCount(Number(evt.target.value.replace(/\D+/g, '') || '0'));
          }}
        />
      </h1>
      <AppBar align={align} itemsCount={itemsCount} />
    </div>
  );
}
