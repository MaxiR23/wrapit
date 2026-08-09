import CardsEmptyState from '@/components/cards/CardsEmptyState';
import DeleteCardDialog from '@/components/cards/DeleteCardDialog';
import EditCardDialog from '@/components/cards/EditCardDialog';

type CardListItem = {
  id: string;
  title: string;
  description: string | null;
};

export default function CardList({ cards }: { cards: CardListItem[] }) {
  if (cards.length === 0) {
    return <CardsEmptyState />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {cards.map((card) => (
        <li
          key={card.id}
          className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{card.title}</p>
              {card.description ? (
                <p className="mt-1 text-muted-foreground">{card.description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <EditCardDialog cardId={card.id} title={card.title} description={card.description} />
              <DeleteCardDialog cardId={card.id} title={card.title} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
