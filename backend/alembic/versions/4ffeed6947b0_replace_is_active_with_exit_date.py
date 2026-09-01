"""replace is_active with exit_date

Employment status becomes a function of exit_date rather than a stored flag, so
a departure takes effect on its own date and the two can never disagree.

Revision ID: 4ffeed6947b0
Revises: aa75004fa9b3
Create Date: 2026-09-01 21:00:51.996208

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ffeed6947b0'
down_revision: Union[str, None] = 'aa75004fa9b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("employee", schema=None) as batch_op:
        batch_op.add_column(sa.Column("exit_date", sa.Date(), nullable=True))

    # Preserve the status of everyone already marked inactive. Their real exit
    # date was never recorded, so the migration date is the closest available
    # approximation; what matters is that they stay inactive, since the predicate
    # treats exit_date <= today as departed. Dropping the column without this
    # would silently reinstate every former employee.
    op.execute(
        "UPDATE employee SET exit_date = CURRENT_DATE "
        "WHERE is_active = 0 AND exit_date IS NULL"
    )

    with op.batch_alter_table("employee", schema=None) as batch_op:
        batch_op.drop_index("ix_employee_is_active")
        batch_op.create_index("ix_employee_exit_date", ["exit_date"], unique=False)
        batch_op.drop_column("is_active")
        batch_op.create_check_constraint(
            "ck_employee_exit_after_hire",
            "exit_date IS NULL OR exit_date >= hire_date",
        )


def downgrade() -> None:
    with op.batch_alter_table("employee", schema=None) as batch_op:
        batch_op.drop_constraint("ck_employee_exit_after_hire", type_="check")
        # Defaulted so the column can be NOT NULL while rows already exist; the
        # correct values are written immediately below.
        batch_op.add_column(
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("1"),
            )
        )

    op.execute(
        "UPDATE employee SET is_active = 0 "
        "WHERE exit_date IS NOT NULL AND exit_date <= CURRENT_DATE"
    )

    with op.batch_alter_table("employee", schema=None) as batch_op:
        batch_op.drop_index("ix_employee_exit_date")
        batch_op.create_index("ix_employee_is_active", ["is_active"], unique=False)
        batch_op.drop_column("exit_date")
